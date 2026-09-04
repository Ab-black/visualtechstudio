// Public payment configuration only.
// Never place Paystack secret keys in this file or anywhere in frontend code.
window.VISUAL_TECH_PAYMENT = {
    provider: "paystack",
    environment: "test",
    publicKey: "pk_test_ae6f2789406e7e7b807f712a161902e525c76307",
    currency: "NGN",
    initializeFunction: "paystack-initialize-transaction"
};
