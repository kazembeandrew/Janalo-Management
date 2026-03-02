// Domain Layer - Value Objects
// AccountCode represents a hierarchical account code (e.g., "1000-01")

export class AccountCode {
  private readonly _code: string;

  constructor(code: string) {
    if (!code || typeof code !== 'string') {
      throw new Error('Account code must be a non-empty string');
    }

    // Validate format (basic validation - can be enhanced)
    const codePattern = /^[0-9]{4}(-[0-9]{2})*$/;
    if (!codePattern.test(code)) {
      throw new Error('Account code must be in format XXXX-XX-XX (digits only)');
    }

    this._code = code;
  }

  get code(): string {
    return this._code;
  }

  get rootCode(): string {
    return this._code.split('-')[0];
  }

  get subCode(): string | null {
    const parts = this._code.split('-');
    return parts.length > 1 ? parts.slice(1).join('-') : null;
  }

  isChildOf(parentCode: AccountCode): boolean {
    return this._code.startsWith(parentCode._code + '-') ||
           this._code === parentCode._code;
  }

  getLevel(): number {
    return this._code.split('-').length;
  }

  toString(): string {
    return this._code;
  }

  equals(other: AccountCode): boolean {
    return this._code === other._code;
  }

  toJSON(): object {
    return {
      code: this._code
    };
  }
}
