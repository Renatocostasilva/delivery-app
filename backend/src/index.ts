import { app } from "./app.js";
import { setGateway } from "./payments/gateway.js";
import { FakeGateway } from "./payments/fake-gateway.js";
import {
  createMercadoPagoGateway,
  mercadoPagoConfigurado,
} from "./integrations/mercadopago/index.js";

// ─── Injeta o gateway de pagamento ──────────────────────────────────────────

// Dev local: `PAYMENT_GATEWAY=fake` usa um gateway simulado (QR/copia-e-cola de
// demonstração, aprova no próximo poll). SOMENTE para teste local — em produção
// a variável não é definida e o gateway real (MercadoPago) é usado.
function criarGatewayFakeDev(): FakeGateway {
  const fake = new FakeGateway({ pixStatus: "PENDENTE", cartaoStatus: "PENDENTE" });
  const original = fake.consultarStatus.bind(fake);
  fake.consultarStatus = async (idGateway: string) => {
    const anterior = await original(idGateway);
    if (anterior.status === "PENDENTE") {
      return { ...anterior, status: "APROVADO" as const, atualizadoEm: new Date() };
    }
    return anterior;
  };
  return fake;
}

if (process.env.PAYMENT_GATEWAY === "fake") {
  setGateway(criarGatewayFakeDev());
  console.log("[payments] Gateway FAKE (teste local) ativo — nenhuma cobrança real.");
} else if (mercadoPagoConfigurado()) {
  try {
    setGateway(createMercadoPagoGateway());
    console.log("[payments] Gateway MercadoPago ativo.");
  } catch (err) {
    console.warn("[payments] Falha ao inicializar gateway MercadoPago:", err);
  }
} else {
  console.warn(
    "[payments] Credenciais MercadoPago não encontradas; endpoints de pagamento retornarão 503.",
  );
}

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
