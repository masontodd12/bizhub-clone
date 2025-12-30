import { requireActiveAccess } from "@/src/lib/requireActiveAccess";
import DealCalculatorClient from "./DealCalculatorClient";

export default async function Page() {
  await requireActiveAccess();
  return <DealCalculatorClient />;
}
