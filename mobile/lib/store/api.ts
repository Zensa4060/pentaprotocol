import API from "@/lib/api";
import { fetchProfile } from "@/lib/profile";
import type { GridBundle } from "@/lib/store/catalog";

export async function purchaseStoreItem(
  itemId: string,
  price: number,
  shardPrice = 0,
): Promise<void> {
  await API.post("/api/store/purchase-item", {
    item_id: itemId,
    price,
    shard_price: shardPrice,
  });
  await fetchProfile();
}

/** Buy board + piece separately (web bundle parity). */
export async function purchaseGridBundle(bundle: GridBundle, owned: Set<string>): Promise<void> {
  if (!owned.has(bundle.boardId)) {
    await purchaseStoreItem(bundle.boardId, 1599, 0);
  }
  const fresh = new Set(
    (await fetchProfile()).purchased_items ?? [],
  );
  if (!fresh.has(bundle.pieceId)) {
    await purchaseStoreItem(bundle.pieceId, 599, 0);
  }
  await fetchProfile();
}

export async function submitUpiPayment(
  utr: string,
  amount: number,
  packageId: string,
  currencyType: "protocredits" | "shards",
): Promise<void> {
  await API.post("/api/store/upi-submit", {
    utr: utr.trim(),
    amount,
    package_id: packageId,
    currency_type: currencyType,
  });
}
