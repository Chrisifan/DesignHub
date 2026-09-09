# Project-scoped metadata storage

Each design project will keep its own metadata database alongside its content directories, while the workspace holds only a rebuildable index and shared resources. This keeps project packages independently movable and recoverable without coupling their history to a workspace-wide database.
