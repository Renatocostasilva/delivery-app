import { app } from "./app.js";
import { setGateway } from "./payments/gateway.js";
import {
  createMercadoPagoGateway,
  mercadoPagoConfigurado,
} from "./integrations/mercadopago/index.js";

// Injeta o gateway de pagamento se as credenciais estiverem no ambiente.
if (mercadoPagoConfigurado()) {
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
