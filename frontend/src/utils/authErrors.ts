export type AuthFieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

function normalizeMessage(error: string) {
  return error.trim().toLowerCase();
}

export function mapLoginError(error: string): AuthFieldErrors {
  const normalized = normalizeMessage(error);

  if (normalized.includes("invalid credentials")) {
    return {
      password: "Incorrect email or password."
    };
  }

  if (normalized.includes("password")) {
    return {
      password: error
    };
  }

  if (normalized.includes("email")) {
    return {
      email: error
    };
  }

  return {
    form: error
  };
}

export function mapSignupError(error: string): AuthFieldErrors {
  const normalized = normalizeMessage(error);

  if (normalized.includes("confirm password") || normalized.includes("passwords do not match")) {
    return {
      confirmPassword: error
    };
  }

  if (normalized.includes("display name") || normalized.includes("username")) {
    return {
      displayName: error
    };
  }

  if (normalized.includes("email")) {
    return {
      email: error
    };
  }

  if (normalized.includes("password")) {
    return {
      password: error
    };
  }

  return {
    form: error
  };
}
