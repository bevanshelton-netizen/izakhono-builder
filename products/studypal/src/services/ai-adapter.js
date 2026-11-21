class AiAdapter {
  async tutorResponse() {
    throw new Error("AI provider not configured");
  }

  async estimateUsage() {
    throw new Error("AI provider not configured");
  }
}

module.exports = { AiAdapter };
