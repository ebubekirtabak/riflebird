# Branch Naming and Workflow Strategy

This document outlines the **branch naming rules** and **workflow** for contributing to this open-source npm package. The strategy aligns with **semantic versioning (SemVer)** and supports both **core maintainers** and **community contributors**.

---

## 📌 Branch Types

### 1. Permanent Branches

| Branch Name         | Purpose                                                                              | Example         |
| ------------------- | ------------------------------------------------------------------------------------ | --------------- |
| `master`            | Production-ready code. Only updated via release merges (e.g., `v0.1.5`).             | `master`        |
| `dev`               | Integration branch for the next release (e.g., `0.1.5`). All PRs target this branch. | `dev`           |
| `release/<version>` | Pre-release stabilization for a specific version (e.g., bug fixes before `0.1.5`).   | `release/0.1.5` |

---

### 2. Feature/Fix Branches

#### For Core Maintainers (with Jira access)

**Format:** `<type>/<jira-ticket>-<description>`

| Type       | Description                            | Example Branch Name               |
| ---------- | -------------------------------------- | --------------------------------- |
| `feat`     | New feature or enhancement.            | `feat/RF-123-add-validation`      |
| `fix`      | Bug fix.                               | `fix/RF-456-crash-on-input`       |
| `docs`     | Documentation updates.                  | `docs/RF-789-update-readme`       |
| `refactor` | Code refactoring.                      | `refactor/RF-101-simplify-code`   |
| `test`     | Adding or updating tests.              | `test/RF-202-add-unit-tests`      |
| `chore`    | Maintenance tasks.                     | `chore/RF-303-update-deps`        |
| `perf`     | Performance improvements.              | `perf/RF-404-optimize-loops`      |
| `style`    | Code style changes.                    | `style/RF-505-fix-linter`         |
| `build`    | Build system or CI/CD changes.         | `build/RF-606-update-webpack`     |
| `ci`       | CI workflows or pipeline adjustments.  | `ci/RF-707-update-github-actions` |
| `revert`   | Revert of a previous change/branch.    | `revert/RF-808-revert-bad-fix`    |

#### For Community Contributors (without Jira access)

**Format:** `<type>/<github-username>-<description>`

| Type   | Description                 | Example Branch Name           |
| ------ | --------------------------- | ----------------------------- |
| `feat` | New feature or enhancement. | `feat/johndoe-add-validation` |
| `fix`  | Bug fix.                    | `fix/janesmith-fix-typo`      |
| `docs` | Documentation updates.      | `docs/alice-update-guide`     |

---

### 3. Hotfix Branches

**Format:** `hotfix/<version>-<jira-ticket>-<description>`

| Example Branch Name                | Description                             |
| ---------------------------------- | --------------------------------------- |
| `hotfix/0.1.4-RF-999-security`     | Hotfix for `RF-999` in version `0.1.4`. |
| `hotfix/0.1.3-johndoe-memory-leak` | Hotfix by contributor `johndoe`.        |

---

### 4. Experimental Branches

**Format:** `experiment/<github-username>-<description>`

| Example Branch Name                | Description                           |
| ---------------------------------- | ------------------------------------- |
| `experiment/johndoe-new-algorithm` | Experiment by `johndoe`.              |
| `experiment/alice-ui-redesign`     | Prototyping a UI redesign by `alice`. |

---

## 🔄 Workflow

### 1. Feature Development

#### For Core Maintainers:

1. **Create a Jira ticket** (e.g., `RF-123`).
2. Branch from `dev`:
   ```bash
   git checkout -b feat/RF-123-add-validation dev
   ```
3. Commit with the Jira ticket in the message (Conventional Commits):
   ```bash
   git commit -m "feat(RF-123): add validation"
   ```
4. Open a **Pull Request (PR)** targeting `dev` and link the Jira ticket.

#### For Community Contributors:

1. **Fork the repo** and clone your fork.
2. Branch from `dev`:
   ```bash
   git checkout -b feat/johndoe-add-validation dev
   ```
3. Commit with the Jira ticket in the message (if applicable):
   ```bash
   git commit -m "feat(RF-123): add validation"
   ```
   or (if no Jira ticket):
   ```bash
   git commit -m "feat: add validation"
   ```
4. Open a **PR** targeting `dev` and mention the Jira ticket (if any).

---

### 2. Release Process

1. **Merge all features/fixes** into `dev` for the next release (e.g., `0.1.5`).
2. Create a release branch:
   ```bash
   git checkout -b release/0.1.5 dev
   ```
3. **Draft the Release**:
   ```bash
   pnpm changeset
   # Select packages and bump type (minor/patch)
   git commit -am "chore: bump version for release"
   ```
4. **Publish**:
   - Merge `release/0.1.5` into `master`.
   - **Automation**: The GitHub Action will detect the changeset, create a "Version Packages" PR (or publish immediately if you bumped locally).
   - Once published, **Changesets will automatically create the `v0.1.5` tag**.
5. **Sync**:
   - Merge `master` (or the release branch) back into `dev` to ensure `dev` gets the updated `package.json` version and changelog.
   ```bash
   git checkout dev
   git merge release/0.1.5
   ```

---

### 3. Hotfix Workflow

1. Branch from `master`:
   ```bash
   git checkout -b hotfix/0.1.4-RF-999-security master
   ```
2. Fix the issue and test.
3. **Draft the Release**:
   ```bash
   pnpm changeset
   # Select patch
   git commit -am "chore: hotfix release"
   ```
4. **Publish**:
   - Merge into `master`.
   - Changesets Action will handle the publishing and tagging.
5. **Sync**:
   - Merge into `dev` to include the fix in future releases.

---

### 3. Jira Integration

- Use [Jira Smart Commits](https://support.atlassian.com/jira-software-cloud/docs/process-issues-with-smart-commits/) to auto-link branches and PRs.
- Configure Jira to transition tickets when PRs are merged (e.g., "In Progress" → "Done").

---

### 4. PR Template

We use the `.github/pull_request_template.md` file to remind contributors to link Jira tickets.

```markdown
### Description

<!-- Describe your changes. -->

### Jira Ticket

<!-- Link to the Jira ticket (e.g., RF-123) or write "None". -->
```

---

## 📝 Contribution Guidelines

Add this to your `CONTRIBUTING.md`:

### Branch Naming Rules

- **Core maintainers**: Use `feat/RF-123-description` (replace `RF-123` with the Jira ticket key).
- **Community contributors**: Use `feat/your-username-description`.
- **Hotfixes**: Use `hotfix/version-jira-ticket-description` (e.g., `hotfix/0.1.4-RF-999-security`).
- **Experiments**: Use `experiment/your-username-description`.

### Example Workflow

```bash
# For core maintainers
git checkout -b feat/RF-123-add-validation dev

# For community contributors
git checkout -b feat/johndoe-add-validation dev
```

---

## 🎯 Why This Strategy?

1. **Traceability**: Jira tickets are linked to branches and PRs.
2. **Flexibility**: Works for both maintainers and community contributors.
3. **Automation-Friendly**: Easy to parse branch names in scripts and CI.
4. **Scalable**: Clear rules for everyone, regardless of their role.
