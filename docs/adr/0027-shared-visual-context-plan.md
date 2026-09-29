# Conversation and generation share a visual context plan

Designer conversation will classify project images into an explicit, persisted visual context plan, and image generation will consume that same plan instead of inferring roles again from a flattened attachment list. This adds structured state and conservative fallbacks, but prevents a conversation from promising to preserve an original image that the generation request never receives.

Generated variants may become the current edit target without replacing visual anchors. Invalid or low-confidence classification keeps relevant images rather than silently dropping them; generation pauses only when the edit target cannot be determined.
