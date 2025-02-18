export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export const EntityNotExistsError = new RepositoryError("Entity doesn't exist");
export const DuplicatedEntityError = new RepositoryError("Duplicated Entity");
export const InvalidEntityStateError = new RepositoryError("Entity state is invalid");

export interface Identifiable {
  id: number;
}

export interface EntitiesRepository<E extends Identifiable> {
  load(entityById: { [id: number]: E }): void;
  getAll(): Promise<E[]>;
  getById(id: number): Promise<E>;
  save(entity: E): Promise<E>;
  update(entity: E): Promise<E>;
  delete(id: number): Promise<void>;
}