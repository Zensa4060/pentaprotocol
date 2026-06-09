/**
 * Friends service — typed wrappers over ``/api/friends/*``
 * (``backend/app/routers/friends.py``). All endpoints are read/write
 * against the existing backend; nothing here changes server behaviour.
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import type {
  CareerMatch,
  FriendRequestRow,
  FriendsList,
  PublicUser,
} from "@/lib/types";
import { isAxiosError } from "axios";

function wrap(err: unknown, fallback: string): ApiError {
  if (isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    return new ApiError(typeof detail === "string" ? detail : fallback, err.response?.status, detail);
  }
  return new ApiError(fallback);
}

export async function getMyFriendCode(): Promise<string> {
  try {
    const res = await API.get<{ friend_code: string }>("/api/friends/me/code");
    return res.data.friend_code;
  } catch (err) {
    throw wrap(err, "Could not load your friend code.");
  }
}

export async function listFriends(): Promise<FriendsList> {
  try {
    const res = await API.get<FriendsList>("/api/friends/list");
    return res.data;
  } catch (err) {
    throw wrap(err, "Could not load friends.");
  }
}

export async function listFriendRequests(): Promise<FriendRequestRow[]> {
  try {
    const res = await API.get<{ requests: FriendRequestRow[] }>("/api/friends/requests");
    return res.data.requests ?? [];
  } catch (err) {
    throw wrap(err, "Could not load requests.");
  }
}

export async function sendFriendRequest(friendCode: string): Promise<void> {
  try {
    await API.post("/api/friends/request", { friend_code: friendCode.trim().toUpperCase() });
  } catch (err) {
    throw wrap(err, "Could not send friend request.");
  }
}

/** In-match "Add friend" — sends a request to an opponent by their user id. */
export async function sendPeerRequest(opponentId: string): Promise<void> {
  try {
    await API.post("/api/friends/peer-request", { opponent_id: opponentId });
  } catch (err) {
    throw wrap(err, "Could not send friend request.");
  }
}

export async function acceptFriendRequest(reqId: string): Promise<void> {
  try {
    await API.post(`/api/friends/requests/${reqId}/accept`);
  } catch (err) {
    throw wrap(err, "Could not accept request.");
  }
}

export async function declineFriendRequest(reqId: string): Promise<void> {
  try {
    await API.post(`/api/friends/requests/${reqId}/decline`);
  } catch (err) {
    throw wrap(err, "Could not decline request.");
  }
}

export async function removeFriend(friendId: string): Promise<void> {
  try {
    await API.delete(`/api/friends/${friendId}`);
  } catch (err) {
    throw wrap(err, "Could not remove friend.");
  }
}

export async function blockUser(targetId: string): Promise<void> {
  try {
    await API.post("/api/friends/block", { user_id: targetId });
  } catch (err) {
    throw wrap(err, "Could not block user.");
  }
}

export async function reportPlayer(input: {
  userId: string;
  reason?: string;
  category?: string;
  roomCode?: string;
}): Promise<void> {
  try {
    await API.post("/api/friends/report", {
      user_id: input.userId,
      reason: input.reason ?? "",
      category: input.category ?? "abuse",
      room_code: input.roomCode,
    });
  } catch (err) {
    throw wrap(err, "Could not submit report.");
  }
}

export async function getFriendProfile(targetId: string): Promise<PublicUser> {
  try {
    const res = await API.get<{ profile: PublicUser }>(`/api/friends/profile/${targetId}`);
    return res.data.profile;
  } catch (err) {
    throw wrap(err, "Could not load profile.");
  }
}

export async function getFriendCareer(targetId: string): Promise<CareerMatch[]> {
  try {
    const res = await API.get<{ history?: CareerMatch[] }>(`/api/friends/career/${targetId}`);
    return res.data?.history ?? [];
  } catch (err) {
    throw wrap(err, "Could not load match history.");
  }
}
