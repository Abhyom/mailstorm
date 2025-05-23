import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	try {
		const { messages } = await req.json();

		if (!messages || !Array.isArray(messages)) {
			return NextResponse.json(
				{ error: "Invalid messages format" },
				{ status: 400 }
			);
		}

		const apiKey = process.env.DEEPSEEK_API_KEY;
		if (!apiKey) {
			return NextResponse.json(
				{ error: "OpenRouter API key is not configured" },
				{ status: 500 }
			);
		}

		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: "deepseek/deepseek-r1:free", // Use the free DeepSeek R1 model via OpenRouter
					messages: messages,
					stream: false,
					max_tokens: 1000,
					temperature: 0.7,
				}),
			}
		);

		if (!response.ok) {
			return NextResponse.json(
				{
					error: `OpenRouter API responded with status: ${response.status}`,
				},
				{ status: response.status }
			);
		}

		const data = await response.json();
		if (!data.choices || !data.choices[0] || !data.choices[0].message) {
			return NextResponse.json(
				{ error: "Invalid response from OpenRouter API" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ email: data.choices[0].message.content });
	} catch (err) {
		console.error("Error in /api/generate-email:", err);
		return NextResponse.json(
			{ error: "Failed to generate email: " + (err as Error).message },
			{ status: 500 }
		);
	}
}
