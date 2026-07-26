function truncate(text, length = 10) {
  if (text.length <= length) {
    return text.padEnd(length);
  }

  return text.substring(0, length - 2) + "..";
}

function formatPrice(price) {
  return price.toLocaleString("id-ID").padStart(12);
}


module.exports = {
    truncate, formatPrice
}