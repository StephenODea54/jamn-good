// schema.org data shared between pages. The return policy matches the "Can I return my order?" FAQ:
// food can't be returned, and problems are put right by replacing or refunding the order.
export const returnPolicy = (origin: string) => ({
  '@type': 'MerchantReturnPolicy',
  '@id': `${origin}/#return-policy`,
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
  merchantReturnLink: `${origin}/faq`,
});
