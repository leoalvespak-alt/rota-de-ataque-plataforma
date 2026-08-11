const required = ['WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_ACCESS_TOKEN']
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  console.log(JSON.stringify({ available: false, checked: false, reason: 'missing_credentials', missing }, null, 2))
  process.exit(0)
}
const version = process.env.META_API_VERSION ?? 'v21.0'
const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}?fields=id,name`, { headers: { authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } })
const body = await response.json()
const available = response.ok && process.env.WHATSAPP_GROUPS_AVAILABLE === 'true'
console.log(JSON.stringify({ available, checked: true, account: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID, apiVersion: version, status: response.status, evidence: body }, null, 2))
process.exit(available ? 0 : 2)
