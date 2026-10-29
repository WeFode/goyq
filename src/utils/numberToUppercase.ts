/** 数字转中文大写（金额展示用） */
export const numberToUppercase = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return "";

  const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const units = ["", "拾", "佰", "仟"];
  const bigUnits = ["", "万", "亿", "兆"];

  if (num === 0) return "零元整";

  const numStr = num.toFixed(2);
  const [integerPart, decimalPart] = numStr.split(".");

  let result = "";
  let integerNum = parseInt(integerPart, 10);

  if (integerNum === 0) {
    result = "零";
  } else {
    let unitIndex = 0;
    while (integerNum > 0) {
      const section = integerNum % 10000;
      if (section !== 0) {
        let sectionStr = "";
        let sectionUnitIndex = 0;
        let rest = section;

        while (rest > 0) {
          const digit = rest % 10;
          if (digit !== 0) {
            sectionStr =
              digits[digit] + units[sectionUnitIndex] + sectionStr;
          } else if (sectionStr !== "" && !sectionStr.startsWith("零")) {
            sectionStr = "零" + sectionStr;
          }
          rest = Math.floor(rest / 10);
          sectionUnitIndex++;
        }

        result = sectionStr + bigUnits[unitIndex] + result;
      } else if (result !== "") {
        result = "零" + result;
      }

      integerNum = Math.floor(integerNum / 10000);
      unitIndex++;
    }
  }

  result += "元";

  if (decimalPart && decimalPart !== "00") {
    const jiao = parseInt(decimalPart[0], 10);
    const fen = parseInt(decimalPart[1], 10);

    if (jiao !== 0) result += digits[jiao] + "角";
    if (fen !== 0) {
      if (jiao === 0) result += "零";
      result += digits[fen] + "分";
    }
  } else {
    result += "整";
  }

  return result;
};
