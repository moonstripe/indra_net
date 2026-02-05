/**
 * Billing routes - Stripe integration
 */

import { Hono } from 'hono';
import type { Env, User } from '../types';
import { requireAuth } from '../utils';

export const billingRoutes = new Hono<{ Bindings: Env }>();

// Stripe price IDs (set these after creating products in Stripe dashboard)
const PRICE_IDS = {
  pro_monthly: 'price_xxx', // TODO: Replace with actual price ID
  pro_yearly: 'price_xxx',
};

/**
 * Create Stripe checkout session
 */
billingRoutes.post('/checkout', requireAuth, async (c) => {
  const user = c.get('user') as User;
  const { plan = 'pro_monthly' } = await c.req.json<{ plan?: string }>();
  
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }
  
  const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
  if (!priceId) {
    return c.json({ error: 'Invalid plan' }, 400);
  }
  
  // Create or get Stripe customer
  let customerId = user.stripe_customer_id;
  
  if (!customerId) {
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: user.email,
        name: user.name,
        'metadata[user_id]': user.id,
      }),
    });
    
    const customer = await customerResponse.json() as { id: string };
    customerId = customer.id;
    
    // Save customer ID
    await c.env.DB.prepare(
      'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
    ).bind(customerId, user.id).run();
  }
  
  // Create checkout session
  const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: 'https://indra.net/settings?success=true',
      cancel_url: 'https://indra.net/settings?canceled=true',
    }),
  });
  
  const session = await sessionResponse.json() as { url: string };
  
  return c.json({ url: session.url });
});

/**
 * Create Stripe customer portal session
 */
billingRoutes.post('/portal', requireAuth, async (c) => {
  const user = c.get('user') as User;
  
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }
  
  if (!user.stripe_customer_id) {
    return c.json({ error: 'No billing account' }, 400);
  }
  
  const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: user.stripe_customer_id,
      return_url: 'https://indra.net/settings',
    }),
  });
  
  const portal = await portalResponse.json() as { url: string };
  
  return c.json({ url: portal.url });
});

/**
 * Stripe webhook handler
 */
billingRoutes.post('/webhook', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }
  
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }
  
  // TODO: Verify webhook signature using c.env.STRIPE_WEBHOOK_SECRET
  // This requires a crypto library compatible with Workers
  
  const event = await c.req.json() as {
    type: string;
    data: {
      object: {
        customer: string;
        status?: string;
      };
    };
  };
  
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Update user tier based on subscription status
      const tier = subscription.status === 'active' ? 'pro' : 'hobby';
      
      await c.env.DB.prepare(
        'UPDATE users SET tier = ? WHERE stripe_customer_id = ?'
      ).bind(tier, customerId).run();
      
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Downgrade to hobby
      await c.env.DB.prepare(
        'UPDATE users SET tier = "hobby" WHERE stripe_customer_id = ?'
      ).bind(customerId).run();
      
      break;
    }
  }
  
  return c.json({ received: true });
});
