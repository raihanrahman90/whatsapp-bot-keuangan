import { createApiServer } from "./api/server";

const port = Number(process.env.PORT || 3001);
const app = createApiServer();

app.listen(port, () => {
  console.log(`WhatsApp bot and API running on port ${port}`);
});
