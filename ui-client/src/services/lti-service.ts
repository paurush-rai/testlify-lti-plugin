import { getLtiProvider } from "../lib/lti-provider";

export const getMembers = async (token: string) => {
  const lti = await getLtiProvider();
  try {
    const members = await lti.NamesAndRoles.getMembers(token);
    if (!members || !members.members) return [];
    return members.members;
  } catch (e) {
    console.error("Error fetching members", e);
    throw new Error("Failed to fetch members");
  }
};

export const getLineItems = async (token: string, resourceLinkId: string) => {
  const lti = await getLtiProvider();
  try {
    const lineItems = await lti.Grade.getLineItems(token, { resourceLinkId });
    return lineItems.lineItems || [];
  } catch (e) {
    console.error("Error fetching line items", e);
    return [];
  }
};
