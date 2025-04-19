// Serverless function to handle Claude API requests
exports.handler = async function(event, context) {
  // Reject non-POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { message, history, skinConcerns, skinType } = data;

    // System prompt that teaches Claude about its role
    const systemPrompt = `You are Dear Aesu, an AI-powered skincare consultant for a luxury skincare brand.
    
You help customers find the perfect skincare products based on their skin type, concerns, and needs.

Your expertise includes:
- Understanding different skin types (oily, dry, combination, sensitive)
- Knowledge of common skin concerns (acne, aging, hyperpigmentation, etc.)
- Familiarity with active ingredients and their benefits
- Ability to recommend complete skincare routines

When recommending products, use the following format for each product so the interface can display it properly:
<product>
  <n>Product Name</n>
  <description>Brief description of benefits</description>
  <key_ingredients>Key ingredient 1, Key ingredient 2</key_ingredients>
  <skin_types>Type 1, Type 2</skin_types>
  <price>$XX.XX</price>
</product>

Be friendly, professional, and empathetic. Ask clarifying questions if needed to provide the best recommendations.`;

    // Construct messages array for Claude
    const messages = [
      { role: "system", content: systemPrompt },
      ...history || [],
      { role: "user", content: message }
    ];

    // Additional context about skin type and concerns if provided
    if (skinType || skinConcerns) {
      let contextMessage = "Additional context: ";
      if (skinType) contextMessage += `Skin type: ${skinType}. `;
      if (skinConcerns && skinConcerns.length > 0) {
        contextMessage += `Skin concerns: ${skinConcerns.join(", ")}.`;
      }
      messages.push({ role: "system", content: contextMessage });
    }

    // Make request to Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",  // You can change to Opus or Sonnet for higher quality
        max_tokens: 1000,
        messages: messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Anthropic API error:", errorData);
      return { 
        statusCode: response.status, 
        body: JSON.stringify({ error: "Error communicating with AI service" }) 
      };
    }

    const responseData = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: JSON.stringify({
        message: responseData.content[0].text,
        id: responseData.id
      })
    };
  } catch (error) {
    console.error("Function error:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Internal server error" }) 
    };
  }
};
