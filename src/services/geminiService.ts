import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getHelpResponse = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are the AI Help Assistant for StudySync, a study material exchange portal. 
        Your goal is to guide students on how to use the platform.
        Features include:
        - Uploading notes: Go to 'My Notes' or 'Materials' and click 'Upload'.
        - Finding materials: Use the 'Search' bar in the 'Materials' section.
        - Study Groups: Create or join groups in the 'Groups' section.
        - Chat: Once in a group, use the real-time chat.
        - Profile: Update your details in the 'Profile' section.
        - Verification: Users must verify their email and mobile via OTP during registration.
        Keep your answers concise and student-friendly.`,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later!";
  }
};
