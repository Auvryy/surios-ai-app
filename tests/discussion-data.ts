import type { Analysis } from "../src/lib/report-contracts";
export const uid = (n: number) =>
  `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const postId = uid(1),
  siblingId = uid(2),
  quoteId = uid(3),
  hazardId = uid(4),
  commentId = uid(5);
export const user = {
  id: uid(10),
  name: "Demo Mobile Citizen",
  email: "discussion@example.test",
  role: "CITIZEN",
  accountStatus: "ACTIVE",
  avatarUrl: null,
};
export const neighbour = {
  id: uid(11),
  name: "Demo Neighbour",
  avatarUrl: null,
  role: "CITIZEN",
};
export const stamp = "2026-10-25T01:00:00.000Z";
export const analysis: Analysis = {
  isValidInfrastructure: true,
  infrastructureType: "DRAINAGE",
  distressType: "drainage_cover_missing",
  hazardSeverity: 3,
  riskLevel: "LOW",
  summary: "Demo original visual assessment.",
  recommendedAction: "Inspect the cover on site.",
  vruDetails: "",
  severityEvidence: {
    visibleDefects: ["Demo visible missing cover"],
    reportedConditions: ["Demo reporter claim"],
    criticalDangerVisible: false,
    confidence: "MEDIUM",
    limitations: "Demo image only.",
  },
};
export const comment = (
  n = 5,
  body = "Demo saved comment",
  parentId: string | null = null,
) => ({
  id: uid(n),
  parentId,
  body,
  author: neighbour,
  createdAt: stamp,
  likes: 0,
  userLiked: false,
  replies: 0,
});
export function source(id = postId) {
  return {
    id,
    title:
      id === postId ? "Demo drainage cover report" : "Demo linked observation",
    body: "Demo full report description with public access context.",
    locationName: "Demo Santa Cruz, Laguna",
    latitude: 14.28,
    longitude: 121.42,
    reportId: hazardId,
    reportStatus: "RESOLVED",
    reportSeverity: 2,
    reportRiskLevel: "LOW",
    governmentUpdateLink: `/community/post/${siblingId}?repost=${quoteId}#repost-${quoteId}`,
    createdAt: stamp,
    deletedAt: null as string | null,
    deleted: false,
    author: user,
    media: [
      {
        id: uid(21),
        kind: "photo" as const,
        url: "/media/demo.png",
        name: "Demo report photo",
        mimeType: "image/png",
      },
      {
        id: uid(22),
        kind: "video" as const,
        url: "/media/demo.mp4",
        name: "Demo report video",
        mimeType: "video/mp4",
      },
    ],
    coverId: uid(21),
    analysis,
    confirmations: 0,
    userConfirmed: false,
    reposts: 1,
    userReposted: false,
    comments: [comment()],
  };
}
export function official() {
  return {
    id: quoteId,
    body: "Demo official repair progress and evidence.",
    createdAt: stamp,
    author: {
      id: uid(12),
      name: "Demo Municipal Office",
      avatarUrl: null,
      role: "OFFICER",
    },
    media: [],
    post: source(siblingId),
    governmentUpdate: {
      status: "IN_PROGRESS" as const,
      budgetType: "ESTIMATED" as const,
      budget: [{ label: "Demo replacement cover", amount: 1250.5 }],
      attachments: [
        {
          id: uid(23),
          kind: "photo" as const,
          url: "/media/official.png",
          name: "Demo official evidence",
          mimeType: "image/png",
        },
        {
          id: uid(24),
          kind: "document" as const,
          url: "/media/official.pdf",
          name: "Demo work record.pdf",
          mimeType: "application/pdf",
        },
      ],
    },
    quotedRepostId: null as string | null,
    quotedRepost: null,
    likes: 0,
    userLiked: false,
    reposts: 0,
    comments: [comment(6, "Demo update-only comment")],
  };
}
