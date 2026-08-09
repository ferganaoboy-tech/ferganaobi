/**
 * Mahsulotning o'lchov birligidan qat'iy nazar, 
 * uni bazaviy birlik (rulon) ga aylantirib beradigan yordamchi funksiya.
 * @param {string} unit - 'rulon', 'quti', yoki 'metr'
 * @param {number} quantity - miqdori
 * @param {Object} product - db dagi Product obyekti
 * @returns {number} - Hisoblangan rulonlar soni
 */
exports.calculateQuantityInRolls = (unit, quantity, product) => {
  let quantityInRolls = 0;
  
  if (['rulon', 'dona', 'kv.m'].includes(unit)) {
    quantityInRolls = Number(quantity);
  } else if (unit === 'quti') {
    quantityInRolls = Number(quantity) * product.rollsPerBox;
  } else if (unit === 'metr') {
    quantityInRolls = Number(quantity) / product.rollLength;
  }

  return quantityInRolls;
};
