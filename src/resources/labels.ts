import type { HttpClient } from "../utils/http";
import type {
  Label,
  LabelListResponse,
  CreateLabelRequest,
} from "../types";

export class LabelsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async create(request: CreateLabelRequest): Promise<Label> {
    return this.http.request<Label>({
      method: "POST",
      path: "/labels",
      body: { ...request },
    });
  }

  async list(): Promise<LabelListResponse> {
    return this.http.request<LabelListResponse>({
      method: "GET",
      path: "/labels",
    });
  }

  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/labels/${id}`,
    });
  }
}
