// Public payment configuration only.
// Never place Paystack secret keys in this file or anywhere in frontend code.
window.VISUAL_TECH_PAYMENT = {
    provider: "paystack",
    environment: "live",
    publicKey: "pk_live_5318330fd96c384bcc475ca0e9fb35ed95d16368",
    currency: "NGN",
    initializeFunction: "paystack-initialize-transaction"
};
