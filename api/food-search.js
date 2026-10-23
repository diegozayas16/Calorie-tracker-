// Vercel serverless function: GET /api/food-search?q=banana
// Forwards the search to the USDA FoodData Central API so the API key stays on the
// server (set USDA_API_KEY in the Vercel project's Environment Variables).

const USDA_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"];
// Energy (kcal, plus the two Atwater variants), protein, fat (two forms), carbs (two forms)
const NUTRIENT_IDS = new Set([1008, 2047, 2048, 1003, 1004, 1085, 1005, 1050]);

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = String(req.query.q || "").trim();
  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: "Search must be 2 to 100 characters" });
  }

  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  try {
    const response = await fetch(`${USDA_URL}?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, dataType: DATA_TYPES, pageSize: 25 }),
    });

    if (response.status === 429) {
      return res.status(429).json({ error: "Too many searches right now, try again later" });
    }
    if (!response.ok) {
      return res.status(502).json({ error: "Food database unavailable" });
    }

    const data = await response.json();
    // Send back only the fields the app uses
    const foods = (data.foods || []).map((f) => ({
      fdcId: f.fdcId,
      description: f.description,
      dataType: f.dataType,
      brandOwner: f.brandOwner,
      brandName: f.brandName,
      servingSize: f.servingSize,
      servingSizeUnit: f.servingSizeUnit,
      householdServingFullText: f.householdServingFullText,
      foodNutrients: (f.foodNutrients || [])
        .filter((n) => NUTRIENT_IDS.has(n.nutrientId))
        .map((n) => ({ nutrientId: n.nutrientId, unitName: n.unitName, value: n.value })),
    }));

    // Let Vercel's CDN reuse results for a day, so repeat searches don't use the API quota
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({ foods });
  } catch (e) {
    return res.status(502).json({ error: "Food database unavailable" });
  }
};
