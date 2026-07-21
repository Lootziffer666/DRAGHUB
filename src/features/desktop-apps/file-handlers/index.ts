export type { FileHandlerDefinition, FileHandlerSurface, FileResource } from "./types";
export {
  registerFileHandler,
  listFileHandlers,
  handlersFor,
  handlersForSurface,
  defaultFileHandler,
  extensionOf,
} from "./registry";
export { registerDefaultFileHandlers } from "./default-handlers";
export { OpenWithMenu } from "./OpenWithMenu";

import { registerDefaultFileHandlers } from "./default-handlers";

// Side effect: importing the registry anywhere in the app ensures the
// built-in handlers are registered, the same way importing the application
// registry makes its default applications available.
registerDefaultFileHandlers();
