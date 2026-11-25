use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::error::AppError;

/// Parse a client-supplied draft id as a UUID.
///
/// Draft ids are generated with `crypto.randomUUID()` on the client. Parsing
/// them here guarantees that the value is safe to use as a single path
/// component: a valid UUID cannot contain `/`, `\`, `..`, or an absolute path.
pub(crate) fn parse_draft_id(raw: &str) -> Result<Uuid, AppError> {
    Uuid::parse_str(raw).map_err(|_| AppError::BadRequest("Invalid draft id".to_string()))
}

/// Build the attachment directory for a validated draft id.
///
/// `draft_id` is already a `Uuid`, so its canonical string form is a single
/// safe path component. The prefix check is a belt-and-braces guard in case
/// this helper is ever changed to accept a less strict type.
pub(crate) fn attachment_dir(
    data_dir: &str,
    user_hash: &str,
    draft_id: Uuid,
) -> Result<PathBuf, AppError> {
    let base = Path::new(data_dir).join(user_hash).join("attachments");
    let dir = base.join(draft_id.to_string());
    if !dir.starts_with(&base) {
        return Err(AppError::BadRequest("Invalid draft id".to_string()));
    }
    Ok(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    const UUID: &str = "6f8b4d2a-1c3e-4f5a-9b7d-2e1f0a3c4b5d";

    #[test]
    fn accepts_a_canonical_uuid() {
        let parsed = parse_draft_id(UUID).expect("valid UUID");
        assert_eq!(parsed.to_string(), UUID);
    }

    #[test]
    fn rejects_absolute_paths() {
        assert!(parse_draft_id("/data").is_err());
        assert!(parse_draft_id("/etc/passwd").is_err());
    }

    #[test]
    fn rejects_path_traversal() {
        for value in ["..", "../..", "../../../data", "..%2F..%2Fdata"] {
            assert!(parse_draft_id(value).is_err(), "accepted {value}");
        }
    }

    #[test]
    fn rejects_non_uuid_values() {
        for value in ["", "not-a-uuid", "6f8b4d2a", "6f8b4d2a-1c3e-4f5a-9b7d"] {
            assert!(parse_draft_id(value).is_err(), "accepted {value}");
        }
    }

    #[test]
    fn attachment_dir_stays_under_user_attachments() {
        let draft_id = parse_draft_id(UUID).unwrap();
        let dir = attachment_dir("/data", "user-hash", draft_id).unwrap();
        assert_eq!(
            dir,
            Path::new("/data")
                .join("user-hash")
                .join("attachments")
                .join(UUID)
        );
        assert!(dir.starts_with(Path::new("/data/user-hash/attachments")));
    }
}
