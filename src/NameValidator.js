function isSymbolIsLetter(symbol) {
  if (!(symbol >= 'a' && symbol <= 'z')) return false;
  return true;
}

function isSymbolIsDigit(symbol) {
  if (!(symbol >= '0' && symbol <= '9')) return false;
  return true;
}

function isValidSequence(sequence) {
  for (let i = 0; i < sequence.length; i += 1) {
    if (!(isSymbolIsLetter(sequence.charAt(i)) ||
        isSymbolIsDigit(sequence.charAt(i)) ||
        sequence.charAt(i) === '-')) {
      return false;
    }
  }
  return true;
}

function isNameValid(name) {
  const labels = name.split('.');
  for (let i = 0; i < labels.length; i += 1) {
    if (!isSymbolIsLetter(labels[i].charAt(0))) {
      return false;
    }

    if (!(isSymbolIsLetter(labels[i].charAt(labels[i].length - 1)) ||
      !isSymbolIsDigit(labels[i].length - 1))) {
      return false;
    }

    if (!isValidSequence(labels[i])) return false;
  }
  return true;
}

function isCheapName(name) {
  for (let i = 0; i < name.length; i += 1) {
    const c = name.charAt(i);
    if (c >= '0' && c <= '9') return true;
    if (c === '.' || c === '-' || c === '/') return true;
    switch (c) {
      case 'a':
      case 'e':
      case 'i':
      case 'o':
      case 'u':
      case 'y':
        return true;
      default:
        break;
    }
  }
  return false;
}

module.exports = {
  isNameValid,
  isCheapName
};
