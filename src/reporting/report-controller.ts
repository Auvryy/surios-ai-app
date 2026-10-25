import { isRecord } from "../auth/contracts";
import { ApiError } from "../lib/api-client";
import {
  parseAnalysis,
  parseAssessment,
  parsePublished,
  type Analysis,
  type Assessment,
  type PublishedReport,
} from "../lib/report-contracts";
import { validCoordinate } from "../lib/roads";
import {
  mediaError,
  type Attachment,
  type ReportLocation,
  type Request,
} from "./contracts";

export type ReportState = {
  title: string;
  body: string;
  attachments: Attachment[];
  cover: string;
  location: ReportLocation;
  assessment: Assessment | null;
  rejection: Analysis | null;
  busy: "assessing" | "publishing" | null;
  error: string;
  errorScope: "media" | "assessment" | "publish" | null;
  note: string;
  published: PublishedReport | null;
};
export class ReportController {
  private state: ReportState = {
    title: "",
    body: "",
    attachments: [],
    cover: "",
    location: { mode: "point", point: null, road: null, name: "" },
    assessment: null,
    rejection: null,
    busy: null,
    error: "",
    errorScope: null,
    note: "",
    published: null,
  };
  private listeners = new Set<() => void>();
  private version = 0;
  private pending: { id: string; abort: AbortController } | null = null;
  private cleanup: Promise<void> = Promise.resolve();
  private disposed = false;
  constructor(
    private request: Request,
    private uuid: () => string,
    private form: (
      files: Attachment[],
      title: string,
      body: string,
    ) => FormData,
  ) {}
  getSnapshot = () => this.state;
  // React development Strict Mode replays effect setup/cleanup on the same instance.
  activate() {
    this.disposed = false;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(value: Partial<ReportState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    this.listeners.forEach((l) => l());
  }
  private discard(id: string) {
    this.cleanup = this.cleanup
      .then(async () => {
        await this.request(`/api/community/drafts/${encodeURIComponent(id)}`, {
          method: "DELETE",
          timeoutMs: 10000,
        });
      })
      .catch(() => {
        /* Server expires unpublished drafts; local invalidation always prevents reuse. */
      });
  }
  private invalidate(note = "") {
    this.version++;
    const id = this.pending?.id || this.state.assessment?.draftId;
    this.pending?.abort.abort();
    this.pending = null;
    if (id) this.discard(id);
    this.set({
      assessment: null,
      rejection: null,
      error: "",
      errorScope: null,
      note,
      busy: null,
    });
  }
  edit(field: "title" | "body", value: string) {
    if (this.state.busy === "publishing" || this.state.published) return;
    this.invalidate(
      "Text changed. Assess again to include your current headline and caption.",
    );
    this.set({ [field]: value.slice(0, field === "title" ? 120 : 2000) });
  }
  add(files: Attachment[]) {
    if (!files.length || this.state.busy === "publishing") return;
    const combined = [...this.state.attachments, ...files],
      error = mediaError(combined);
    if (error) {
      this.set({ error, errorScope: "media" });
      return;
    }
    this.invalidate(
      "Evidence changed. Assess your current attachments before publishing.",
    );
    this.set({
      attachments: combined,
      cover: this.state.cover || combined[0].id,
    });
  }
  remove(id: string) {
    if (this.state.busy === "publishing") return;
    this.invalidate("Evidence changed. Assess again before publishing.");
    const attachments = this.state.attachments.filter((f) => f.id !== id);
    this.set({
      attachments,
      cover:
        this.state.cover === id ? attachments[0]?.id || "" : this.state.cover,
    });
  }
  setCover(id: string) {
    if (!this.state.busy && this.state.attachments.some((f) => f.id === id))
      this.set({ cover: id });
  }
  setLocation(location: ReportLocation) {
    if (this.state.busy !== "publishing") this.set({ location });
  }
  showError(error: string) {
    this.set({ error, errorScope: error ? "media" : null });
  }
  cancelAssessment() {
    if (this.state.busy === "assessing")
      this.invalidate(
        "Assessment cancelled. Your text and attachments are still here.",
      );
  }
  async assess() {
    if (this.state.busy || this.state.published || this.disposed) return;
    if (!this.state.attachments.length) {
      this.set({
        errorScope: "media",
        error: "Add at least one photo or video first.",
      });
      return;
    }
    this.invalidate();
    const version = this.version,
      id = this.uuid(),
      abort = new AbortController();
    const selected = [...this.state.attachments],
      title = this.state.title.trim(),
      body = this.state.body.trim();
    this.pending = { id, abort };
    this.set({ busy: "assessing", note: "" });
    try {
      await this.cleanup;
      if (version !== this.version || this.disposed) return;
      const response = await this.request("/api/community/assess", {
        method: "POST",
        form: this.form(selected, title, body),
        assessmentId: id,
        signal: abort.signal,
        timeoutMs: 180000,
      });
      if (version !== this.version || this.disposed) {
        this.discard(id);
        return;
      }
      const assessment = parseAssessment(response, selected.length);
      if (
        assessment.draftId !== id ||
        assessment.context.caption !== body ||
        (title && assessment.context.headline !== title)
      )
        throw new ApiError(
          "The assessed context does not match this post. Assess again.",
        );
      this.set({
        assessment,
        title: title || assessment.context.headline,
        body: assessment.context.caption,
        note: "Assessment saved for up to 24 hours. Choose the cover and confirm the location.",
      });
    } catch (cause) {
      if (version !== this.version || this.disposed) return;
      this.discard(id);
      let rejection: Analysis | null = null;
      if (
        cause instanceof ApiError &&
        cause.status === 422 &&
        isRecord(cause.details)
      ) {
        try {
          rejection = parseAnalysis(cause.details.analysis);
        } catch {
          /* The server's rejection message is still shown. */
        }
      }
      this.set({
        errorScope: "assessment",
        error:
          cause instanceof Error
            ? cause.message
            : "Could not assess this evidence. Try again.",
        rejection,
      });
    } finally {
      if (version === this.version && !this.disposed) {
        this.pending = null;
        this.set({ busy: null });
      }
    }
  }
  async publish(): Promise<PublishedReport | null> {
    if (this.state.busy || this.disposed || this.state.published)
      return this.state.published;
    const { assessment, location, title, body, attachments, cover } =
      this.state;
    if (!assessment) {
      this.set({
        errorScope: "assessment",
        error: "Assess your current evidence before publishing.",
      });
      return null;
    }
    if (
      title.trim().length < 3 ||
      location.name.trim().length < 3 ||
      !validCoordinate(location.point) ||
      (location.mode === "road" && !location.road)
    ) {
      this.set({
        errorScope: "publish",
        error:
          "Add a headline, a location name, and a point pin or road section.",
      });
      return null;
    }
    const index = attachments.findIndex((f) => f.id === cover),
      coverId = assessment.media[index]?.id;
    if (!coverId) {
      this.set({
        errorScope: "publish",
        error: "Choose a cover from your assessed attachments.",
      });
      return null;
    }
    this.set({ busy: "publishing", error: "", errorScope: null });
    try {
      const result = parsePublished(
        await this.request("/api/community/posts", {
          method: "POST",
          timeoutMs: 90000,
          body: {
            draftId: assessment.draftId,
            coverId,
            title: title.trim(),
            body: body.trim(),
            locationName: location.name.trim(),
            latitude: location.point[0],
            longitude: location.point[1],
            road:
              location.mode === "road" && location.road
                ? {
                    id: location.road.id,
                    start: location.road.start,
                    end: location.road.end,
                  }
                : null,
          },
        }),
      );
      this.set({ published: result, assessment: null });
      return result;
    } catch (cause) {
      if (cause instanceof ApiError && [404, 409, 410].includes(cause.status))
        this.invalidate(
          "This assessment is no longer current. Assess again to publish.",
        );
      this.set({
        errorScope: "publish",
        error:
          cause instanceof Error
            ? cause.message
            : "Publishing failed. Your draft is still here.",
      });
      return null;
    } finally {
      this.set({ busy: null });
    }
  }
  dispose() {
    // A successful publish owns its evidence. Never discard or cancel a publishing request.
    if (this.state.busy !== "publishing" && !this.state.published)
      this.invalidate();
    this.disposed = true;
    this.listeners.clear();
  }
}
