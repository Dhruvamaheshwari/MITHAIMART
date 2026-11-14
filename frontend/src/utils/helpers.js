// Small functions shared by several pages.

export function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// A variant can be bought only if the shop marked it available AND stock is left.
export function isVariantAvailable(variant) {
  return variant.is_available && variant.stock > 0
}

// Lowest price among the variants that can be bought. null if none can be bought.
export function getStartingPrice(product) {
  const prices = product.variants.filter(isVariantAvailable).map((variant) => variant.price)
  return prices.length > 0 ? Math.min(...prices) : null
}

export function getErrorMessage(error) {
  if (error.response) {
    return `The server returned an error (${error.response.status}). Please try again.`
  }
  return 'Could not reach the server. Please check that the backend is running.'
}
