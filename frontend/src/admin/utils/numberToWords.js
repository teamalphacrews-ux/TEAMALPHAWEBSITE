export function numberToIndianWords(num) {
    if (num === 0) return 'ZERO ONLY';
    const single = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const double = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const format = (n) => {
        if (n < 10) return single[n];
        if (n < 20) return double[n - 10];
        return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + single[n % 10] : '');
    };
    let words = '';
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const hundred = Math.floor(num / 100);
    num %= 100;

    if (crore > 0) words += format(crore) + ' CRORE ';
    if (lakh > 0) words += format(lakh) + ' LAKH ';
    if (thousand > 0) words += format(thousand) + ' THOUSAND ';
    if (hundred > 0) words += format(hundred) + ' HUNDRED ';
    if (num > 0) words += format(num) + ' ';

    return words.trim() + ' ONLY';
}
