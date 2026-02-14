/**
 * Billing routes - Stripe integration
 */

import { Hono } from 'hono';
import type { Env, User } from '../types';
import { requireAuth } from '../utils';

export const billingRoutes = new Hono<{ Bindings: Env }>();

// Stripe price IDs
const PRICE_IDS = {
  pro_monthly: 'price_1T0WVEA1hcASkdZ6tmKeeIJ6',
  pro_yearly: 'price_1T0WVoA1hcASkdZ6NFoHxfwE',
};

/**
 * Get app URL based on environment
 */
function getAppUrl(env: Env): string {
  if (env.APP_URL) return env.APP_URL;
  return env.ENVIRONMENT === 'production' 
    ? 'https://indradb.net' 
    : 'http://localhost:5173';
}

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
  if (!priceId || priceId === 'price_xxx') {
    return c.json({ error: 'Stripe products not configured yet' }, 500);
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
    
    if (!customerResponse.ok) {
      console.error('Stripe customer creation failed:', await customerResponse.text());
      return c.json({ error: 'Failed to create billing account' }, 500);
    }
    
    const customer = await customerResponse.json() as { id: string };
    customerId = customer.id;
    
    // Save customer ID
    await c.env.DB.prepare(
      'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
    ).bind(customerId, user.id).run();
  }
  
  const appUrl = getAppUrl(c.env);
  
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
      success_url: `${appUrl}/settings?success=true`,
      cancel_url: `${appUrl}/settings?canceled=true`,
    }),
  });
  
  if (!sessionResponse.ok) {
    console.error('Stripe session creation failed:', await sessionResponse.text());
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
  
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
  
  const appUrl = getAppUrl(c.env);
  
  const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: user.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    }),
  });
  
  if (!portalResponse.ok) {
    console.error('Stripe portal creation failed:', await portalResponse.text());
    return c.json({ error: 'Failed to create portal session' }, 500);
  }
  
  const portal = await portalResponse.json() as { url: string };
  
  return c.json({ url: portal.url });
});

/**
 * Verify Stripe webhook signature
 * Uses Web Crypto API available in Cloudflare Workers
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1Sig = parts.find(p => p.startsWith('v1='))?.slice(3);
  
  if (!timestamp || !v1Sig) return false;
  
  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  
  // Convert to hex
  const expectedSig = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Constant-time comparison
  if (expectedSig.length !== v1Sig.length) return false;
  let result = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    result |= expectedSig.charCodeAt(i) ^ v1Sig.charCodeAt(i);
  }
  return result === 0;
}

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
  
  // Get raw body for signature verification
  const rawBody = await c.req.text();
  
  // Verify webhook signature
  const isValid = await verifyStripeSignature(
    rawBody,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );
  
  if (!isValid) {
    console.error('Invalid Stripe webhook signature');
    return c.json({ error: 'Invalid signature' }, 401);
  }
  
  const event = JSON.parse(rawBody) as {
    type: string;
    data: {
      object: {
        customer: string;
        status?: string;
      };
    };
  };
  
  console.log('Stripe webhook event:', event.type);
  
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
      
      console.log(`Updated user tier to ${tier} for customer ${customerId}`);
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Downgrade to hobby
      await c.env.DB.prepare(
        'UPDATE users SET tier = "hobby" WHERE stripe_customer_id = ?'
      ).bind(customerId).run();
      
      console.log(`Downgraded user to hobby for customer ${customerId}`);
      break;
    }
  }
  
  return c.json({ received: true });
});
