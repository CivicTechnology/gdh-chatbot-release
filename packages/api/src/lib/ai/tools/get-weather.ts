import { tool } from "ai";
import { z } from "zod";

export const getWeather = tool({
  description: "Get the current weather at a location",
  inputSchema: z.object({
    description: z
      .string()
      .describe(
        "Korte, niet-technische beschrijving in gewone menselijke taal van wat er wordt opgezocht (bijv. 'Weer in Den Haag', 'Temperatuur vandaag'). Wordt getoond aan de gebruiker."
      ),
    latitude: z.number(),
    longitude: z.number(),
  }),
  execute: async ({ description, latitude, longitude }) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
    );

    const weatherData = (await response.json()) as Record<string, unknown>;
    return { description, ...weatherData };
  },
});
