
```javascript
import Anthropic from "@anthropic-ai/sdk";
import readline from "readline";

const client = new Anthropic();

interface Investment {
  id: string;
  name: string;
  symbol: string;
  shares: number;
  buyPrice: number;
  currentPrice: number;
  type: string;
}

interface PortfolioState {
  investments: Investment[];
  cash: number;
  conversationHistory: Array<{ role: string; content: string }>;
}

function generateSimpleGraph(
  prices: number[],
  width: number = 40,
  height: number = 10
): string {
  if (prices.length === 0) return "No data to display";

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;

  const graph: string[][] = Array.from({ length: height }, () =>
    Array(width).fill(" ")
  );

  for (let i = 0; i < Math.min(prices.length, width); i++) {
    const normalizedPrice = (prices[i] - minPrice) / range;
    const row = Math.floor((1 - normalizedPrice) * (height - 1));
    graph[row][i] = "█";
  }

  return graph.map((row) => row.join("")).join("\n");
}

function calculatePortfolioMetrics(state: PortfolioState): {
  totalValue: number;
  totalGain: number;
  gainPercentage: number;
  distribution: Record<string, number>;
} {
  let totalInvested = 0;
  let totalCurrent = 0;
  const distribution: Record<string, number> = {};

  for (const inv of state.investments) {
    const invested = inv.shares * inv.buyPrice;
    const current = inv.shares * inv.currentPrice;
    totalInvested += invested;
    totalCurrent += current;
    distribution[inv.symbol] = current;
  }

  const totalValue = totalCurrent + state.cash;
  const totalGain = totalCurrent - totalInvested;
  const gainPercentage =
    totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return {
    totalValue,
    totalGain,
    gainPercentage,
    distribution,
  };
}

function formatPortfolioDisplay(state: PortfolioState): string {
  const metrics = calculatePortfolioMetrics(state);

  let display = "╔════════════════════════════════════════╗\n";
  display += "║     PORTFOLIO DE INVERSIONES          ║\n";
  display += "╚════════════════════════════════════════╝\n\n";

  display += `Valor Total: $${metrics.totalValue.toFixed(2)}\n`;
  display += `Ganancia: $${metrics.totalGain.toFixed(2)} (${metrics.gainPercentage.toFixed(2)}%)\n`;
  display += `Efectivo Disponible: $${state.cash.toFixed(2)}\n\n`;

  if (state.investments.length > 0) {
    display += "POSICIONES ACTUALES:\n";
    display += "─────────────────────────────────────────\n";

    for (const inv of state.investments) {
      const currentValue = inv.shares * inv.currentPrice;
      const investedValue = inv.shares * inv.buyPrice;
      const gain = currentValue - investedValue;
      const gainPercent = (gain / investedValue) * 100;

      display += `\n${inv.symbol} (${inv.name})\n`;
      display += `  Cantidad: ${inv.shares} acciones\n`;
      display += `  Precio Actual: $${inv.currentPrice.toFixed(2)}\n`;
      display += `  Valor: $${currentValue.toFixed(2)}\n`;
      display += `  Ganancia: $${gain.toFixed(2)} (${gainPercent.toFixed(2)}%)\n`;
    }
  } else {
    display += "No hay inversiones actuales.\n";
  }

  display += "\n─────────────────────────────────────────\n";

  if (state.investments.length > 0) {
    const prices = state.investments.map((inv) => inv.currentPrice);
    display +=
      "\nTendencia de Precios (últimas posiciones):\n" +
      generateSimpleGraph(prices) +
      "\n";
  }

  return display;
}

async function chat(
  userMessage: string,
  state: PortfolioState
): Promise<string> {
  const portfolioContext = formatPortfolioDisplay(state);

  state.conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const systemPrompt = `Eres un asesor financiero experto en inversiones. Ayudas a los usuarios a gestionar su portafolio de inversiones.

ESTADO ACTUAL DEL PORTAFOLIO:
${portfolioContext}

Puedes ayudar a los usuarios con:
1. Analizar su portafolio actual
2. Sugerir inversiones basadas en su perfil de riesgo
3. Explicar estrategias de inversión
4. Analizar tendencias de mercado
5. Gestionar posiciones (comprar/vender acciones)

Cuando el usuario quiera comprar o vender:
- Responde con un JSON especial en la siguiente forma para ejecutar la acción:
  {"action": "buy", "symbol": "AAPL", "shares": 10, "price": 150.25}
  o
  {"action": "sell", "symbol": "AAPL", "shares": 5}

Para cualquier otra consulta, responde normalmente con análisis y consejos financieros.
Sé profesional