export const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/

/**
 * @param {string | number} value
 * @returns {boolean} true for a positive amount with at most two decimal places
 */
export function validAmount(value) {
    return MONEY_PATTERN.test(String(value)) && Number(value) > 0
}
