#!/usr/bin/env node
// One-time, operator-run bootstrap for the first I-CONNECT organisation owner.
// Never expose SUPABASE_SERVICE_ROLE_KEY or run this script from a public endpoint.
const { createClient } = require('@supabase/supabase-js');

const required = [
  'I_CONNECT_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'I_CONNECT_BOOTSTRAP_ORG_SLUG',
  'I_CONNECT_OWNER_EMAIL',
  'I_CONNECT_OWNER_PASSWORD'
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  process.exit(1);
}
if (process.env.I_CONNECT_CONFIRM_OWNER_BOOTSTRAP !== 'YES') {
  console.error('Set I_CONNECT_CONFIRM_OWNER_BOOTSTRAP=YES to confirm this one-time privileged operation.');
  process.exit(1);
}

async function main() {
  const supabase = createClient(
    process.env.I_CONNECT_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: org, error: orgError } = await supabase
    .from('ic_organizations')
    .select('id, slug, name')
    .eq('slug', process.env.I_CONNECT_BOOTSTRAP_ORG_SLUG)
    .maybeSingle();
  if (orgError || !org) throw new Error('The requested I-CONNECT organisation was not found.');

  const { count, error: countError } = await supabase
    .from('ic_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .eq('status', 'active');
  if (countError) throw new Error('Could not verify existing organisation memberships.');
  if ((count || 0) > 0) throw new Error('Bootstrap stopped: this organisation already has an active member.');

  const email = process.env.I_CONNECT_OWNER_EMAIL.trim().toLowerCase();
  const perPage = 1000;
  let page = 1;
  let user = null;
  while (!user) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('Could not inspect existing authentication accounts.');
    user = (data.users || []).find(item => item.email?.toLowerCase() === email) || null;
    if (user || (data.users || []).length < perPage) break;
    page += 1;
  }

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: process.env.I_CONNECT_OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: { account_origin: 'i_connect_owner_bootstrap' }
    });
    if (error || !data.user) throw new Error('Could not create the initial owner account.');
    user = data.user;
  }

  const { data: existing, error: membershipLookupError } = await supabase
    .from('ic_memberships')
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipLookupError) throw new Error('Could not inspect the owner membership.');

  if (existing) {
    const { error } = await supabase.from('ic_memberships')
      .update({ role: 'owner', status: 'active' })
      .eq('id', existing.id);
    if (error) throw new Error('Could not activate the owner membership.');
  } else {
    const { error } = await supabase.from('ic_memberships').insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
      status: 'active'
    });
    if (error) throw new Error('Could not create the owner membership.');
  }

  console.log('I-CONNECT owner bootstrap completed.');
  console.log('Organisation:', org.name, '(' + org.slug + ')');
  console.log('Owner email:', email);
  console.log('Next: sign in through the I-CONNECT authentication flow and verify organisation access.');
}

main().catch(error => {
  console.error(error.message || 'Owner bootstrap failed.');
  process.exit(1);
});
