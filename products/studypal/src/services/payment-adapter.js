class PaymentAdapter {
  async createSubscription() {
    throw new Error("Payment adapter not configured");
  }

  async verifyWebhook() {
    throw new Error("Payment adapter not configured");
  }

  async getSubscriptionStatus() {
    throw new Error("Payment adapter not configured");
  }

  async cancelSubscription() {
    throw new Error("Payment adapter not configured");
  }
}

module.exports = { PaymentAdapter };
