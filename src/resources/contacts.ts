/**
 * Contacts Resource - Contact & List Management
 * @packageDocumentation
 */

import type { HttpClient } from "../utils/http";
import type {
  Contact,
  ContactList,
  CreateContactRequest,
  UpdateContactRequest,
  CreateContactListRequest,
  UpdateContactListRequest,
  ListContactsOptions,
  ContactListResponse,
  ContactListsResponse,
} from "../types";

/**
 * Contacts API resource for managing contacts and contact lists
 *
 * @example
 * ```typescript
 * // Create a contact
 * const contact = await sendly.contacts.create({
 *   phoneNumber: '+15551234567',
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 *
 * // Create a list and add contacts
 * const list = await sendly.contacts.lists.create({ name: 'Newsletter Subscribers' });
 * await sendly.contacts.lists.addContacts(list.id, [contact.id]);
 * ```
 */
export class ContactsResource {
  private readonly http: HttpClient;
  public readonly lists: ContactListsResource;

  constructor(http: HttpClient) {
    this.http = http;
    this.lists = new ContactListsResource(http);
  }

  /**
   * List contacts with optional filtering
   *
   * @param options - Filter and pagination options
   * @returns List of contacts
   *
   * @example
   * ```typescript
   * // List all contacts
   * const { contacts, total } = await sendly.contacts.list();
   *
   * // Search contacts
   * const { contacts } = await sendly.contacts.list({ search: 'john' });
   *
   * // List contacts in a specific list
   * const { contacts } = await sendly.contacts.list({ listId: 'lst_xxx' });
   * ```
   */
  async list(options: ListContactsOptions = {}): Promise<ContactListResponse> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    if (options.search) params.set("search", options.search);
    if (options.listId) params.set("list_id", options.listId);

    const queryString = params.toString();
    const response = await this.http.request<{
      contacts: RawContact[];
      total: number;
      limit: number;
      offset: number;
    }>({
      method: "GET",
      path: `/contacts${queryString ? `?${queryString}` : ""}`,
    });

    return {
      contacts: response.contacts.map((c) => this.transformContact(c)),
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    };
  }

  /**
   * Get a contact by ID
   *
   * @param id - Contact ID
   * @returns The contact with associated lists
   *
   * @example
   * ```typescript
   * const contact = await sendly.contacts.get('cnt_xxx');
   * console.log(`${contact.name}: ${contact.phoneNumber}`);
   * console.log(`In ${contact.lists?.length || 0} lists`);
   * ```
   */
  async get(id: string): Promise<Contact> {
    const response = await this.http.request<RawContact>({
      method: "GET",
      path: `/contacts/${id}`,
    });

    return this.transformContact(response);
  }

  /**
   * Create a new contact
   *
   * @param request - Contact details
   * @returns The created contact
   *
   * @example
   * ```typescript
   * const contact = await sendly.contacts.create({
   *   phoneNumber: '+15551234567',
   *   name: 'Jane Smith',
   *   email: 'jane@example.com',
   *   metadata: { source: 'signup_form', plan: 'premium' }
   * });
   * ```
   */
  async create(request: CreateContactRequest): Promise<Contact> {
    const response = await this.http.request<RawContact>({
      method: "POST",
      path: "/contacts",
      body: {
        phone_number: request.phoneNumber,
        name: request.name,
        email: request.email,
        metadata: request.metadata,
      },
    });

    return this.transformContact(response);
  }

  /**
   * Update a contact
   *
   * @param id - Contact ID
   * @param request - Fields to update
   * @returns The updated contact
   *
   * @example
   * ```typescript
   * const contact = await sendly.contacts.update('cnt_xxx', {
   *   name: 'Jane Doe',
   *   metadata: { plan: 'enterprise' }
   * });
   * ```
   */
  async update(id: string, request: UpdateContactRequest): Promise<Contact> {
    const response = await this.http.request<RawContact>({
      method: "PATCH",
      path: `/contacts/${id}`,
      body: {
        name: request.name,
        email: request.email,
        metadata: request.metadata,
      },
    });

    return this.transformContact(response);
  }

  /**
   * Delete a contact
   *
   * @param id - Contact ID
   *
   * @example
   * ```typescript
   * await sendly.contacts.delete('cnt_xxx');
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/contacts/${id}`,
    });
  }

  private transformContact(raw: RawContact): Contact {
    return {
      id: raw.id,
      phoneNumber: raw.phone_number,
      name: raw.name,
      email: raw.email,
      metadata: raw.metadata,
      optedOut: raw.opted_out,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      lists: raw.lists?.map((l) => ({ id: l.id, name: l.name })),
    };
  }
}

/**
 * Contact Lists sub-resource
 */
export class ContactListsResource {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List all contact lists
   *
   * @returns All contact lists
   *
   * @example
   * ```typescript
   * const { lists } = await sendly.contacts.lists.list();
   * for (const list of lists) {
   *   console.log(`${list.name}: ${list.contactCount} contacts`);
   * }
   * ```
   */
  async list(): Promise<ContactListsResponse> {
    const response = await this.http.request<{ lists: RawContactList[] }>({
      method: "GET",
      path: "/contact-lists",
    });

    return {
      lists: response.lists.map((l) => this.transformList(l)),
    };
  }

  /**
   * Get a contact list by ID
   *
   * @param id - Contact list ID
   * @param options - Pagination options for contacts
   * @returns The contact list with members
   *
   * @example
   * ```typescript
   * const list = await sendly.contacts.lists.get('lst_xxx');
   * console.log(`${list.name}: ${list.contactCount} contacts`);
   *
   * // Get list with paginated contacts
   * const list = await sendly.contacts.lists.get('lst_xxx', { limit: 100 });
   * console.log(`Showing ${list.contacts?.length} of ${list.contactsTotal}`);
   * ```
   */
  async get(id: string, options: { limit?: number; offset?: number } = {}): Promise<ContactList> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));

    const queryString = params.toString();
    const response = await this.http.request<RawContactList>({
      method: "GET",
      path: `/contact-lists/${id}${queryString ? `?${queryString}` : ""}`,
    });

    return this.transformList(response);
  }

  /**
   * Create a new contact list
   *
   * @param request - List details
   * @returns The created list
   *
   * @example
   * ```typescript
   * const list = await sendly.contacts.lists.create({
   *   name: 'VIP Customers',
   *   description: 'High-value customers for priority messaging'
   * });
   * ```
   */
  async create(request: CreateContactListRequest): Promise<ContactList> {
    const response = await this.http.request<RawContactList>({
      method: "POST",
      path: "/contact-lists",
      body: {
        name: request.name,
        description: request.description,
      },
    });

    return this.transformList(response);
  }

  /**
   * Update a contact list
   *
   * @param id - Contact list ID
   * @param request - Fields to update
   * @returns The updated list
   *
   * @example
   * ```typescript
   * const list = await sendly.contacts.lists.update('lst_xxx', {
   *   name: 'Premium Subscribers',
   *   description: 'Updated description'
   * });
   * ```
   */
  async update(id: string, request: UpdateContactListRequest): Promise<ContactList> {
    const response = await this.http.request<RawContactList>({
      method: "PATCH",
      path: `/contact-lists/${id}`,
      body: {
        name: request.name,
        description: request.description,
      },
    });

    return this.transformList(response);
  }

  /**
   * Delete a contact list
   *
   * This does not delete the contacts in the list.
   *
   * @param id - Contact list ID
   *
   * @example
   * ```typescript
   * await sendly.contacts.lists.delete('lst_xxx');
   * ```
   */
  async delete(id: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/contact-lists/${id}`,
    });
  }

  /**
   * Add contacts to a list
   *
   * @param listId - Contact list ID
   * @param contactIds - Array of contact IDs to add
   * @returns Number of contacts added
   *
   * @example
   * ```typescript
   * const result = await sendly.contacts.lists.addContacts('lst_xxx', [
   *   'cnt_abc',
   *   'cnt_def',
   *   'cnt_ghi'
   * ]);
   * console.log(`Added ${result.addedCount} contacts`);
   * ```
   */
  async addContacts(listId: string, contactIds: string[]): Promise<{ addedCount: number }> {
    const response = await this.http.request<{ success: boolean; added_count: number }>({
      method: "POST",
      path: `/contact-lists/${listId}/contacts`,
      body: { contact_ids: contactIds },
    });

    return { addedCount: response.added_count };
  }

  /**
   * Remove a contact from a list
   *
   * @param listId - Contact list ID
   * @param contactId - Contact ID to remove
   *
   * @example
   * ```typescript
   * await sendly.contacts.lists.removeContact('lst_xxx', 'cnt_abc');
   * ```
   */
  async removeContact(listId: string, contactId: string): Promise<void> {
    await this.http.request<void>({
      method: "DELETE",
      path: `/contact-lists/${listId}/contacts/${contactId}`,
    });
  }

  private transformList(raw: RawContactList): ContactList {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      contactCount: raw.contact_count || 0,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      contacts: raw.contacts?.map((c) => ({
        id: c.id,
        phoneNumber: c.phone_number,
        name: c.name,
        email: c.email,
      })),
      contactsTotal: raw.contacts_total,
    };
  }
}

interface RawContact {
  id: string;
  phone_number: string;
  name?: string | null;
  email?: string | null;
  metadata?: Record<string, any>;
  opted_out?: boolean;
  created_at: string;
  updated_at?: string;
  lists?: Array<{ id: string; name: string }>;
}

interface RawContactList {
  id: string;
  name: string;
  description?: string | null;
  contact_count?: number;
  created_at: string;
  updated_at?: string;
  contacts?: Array<{
    id: string;
    phone_number: string;
    name?: string | null;
    email?: string | null;
  }>;
  contacts_total?: number;
}
