import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

// Get a typed object of internal Convex functions exported by this file
const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

// create `authKitEvent` as a named export
export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await ctx.db.insert("users", {
      authId: event.data.id,
      email: event.data.email,
      name: `${event.data.firstName} ${event.data.lastName}`,
    });
  },
  "user.updated": async (ctx, event) => {
    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", event.data.id))
      .unique();
    if (!user) {
      console.warn(`User not found: ${event.data.id}`);
      return;
    }
    await ctx.db.patch(user._id, {
      email: event.data.email,
      name: `${event.data.firstName} ${event.data.lastName}`,
    });
  },
  "user.deleted": async (ctx, event) => {
    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", event.data.id))
      .unique();
    if (!user) {
      console.warn(`User not found: ${event.data.id}`);
      return;
    }
    await ctx.db.delete(user._id);
  },
});

export const { authKitAction } = authKit.actions({
  authentication: async (_ctx, _action, response) => {
    return response.allow();
  },
  userRegistration: async (_ctx, action, response) => {
    // Optional: add custom logic here, e.g. blocking certain domains
    // if (action.userData.email.endsWith("@gmail.com")) {
    //   return response.deny("Gmail accounts are not allowed");
    // }
    return response.allow();
  },
});
