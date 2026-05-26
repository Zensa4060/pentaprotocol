import API from "@/lib/api";
import { fetchProfile } from "@/lib/profile";

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
