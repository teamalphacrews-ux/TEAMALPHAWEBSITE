// Split the subtotal before multiplying so even the largest valid quotation
// stays within JavaScript's exact integer range.
function basisPointAmount(paise, basisPoints, round = Math.round) {
  const units = Math.floor(paise / 10000);
  return units * basisPoints + round((paise % 10000) * basisPoints / 10000);
}

module.exports = { basisPointAmount };
