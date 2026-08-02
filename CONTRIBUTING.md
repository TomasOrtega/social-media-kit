# Contributing to Social Media Kit

Thank you for your interest in contributing to the Social Media Kit! We welcome contributions from developers of all skill levels.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 20.19+ or 22.12+
- **npm** (comes with Node.js)
- **Git** for version control

### Fork and Clone

1. **Fork** this repository to your GitHub account
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/yourusername/social-media-kit.git
   cd social-media-kit
   ```

3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/originalowner/social-media-kit.git
   ```

### Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your OAuth credentials (see SETUP.md for details)
   ```

3. **Start development server**:
   ```bash
   npm start
   ```

4. **Verify setup** by visiting `http://localhost:3000`

## 🛠️ Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our [code standards](#code-standards)

3. **Write/update tests** for your changes (see [Testing](#testing))

4. **Test your changes**:
   ```bash
   npm test                    # Run all tests
   npm run test:watch         # Run tests in watch mode
   npm run test:coverage      # Check test coverage
   ```

5. **Build and verify**:
   ```bash
   npm run build             # Ensure build succeeds
   npm start                 # Test the full application
   ```

6. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add Instagram posting support"
   ```

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add Instagram OAuth integration
fix(formatting): resolve Unicode character counting issue
docs(setup): update LinkedIn API configuration steps
test(tagging): add edge cases for person mapping validation
```

## 🧪 Testing

### Test Requirements

All contributions must include appropriate tests:

- **Unit tests** for utility functions and pure logic
- **Component tests** for React components
- **Integration tests** for complex workflows
- **API tests** for server endpoints

### Test Structure

Tests are organized in a mixed approach:
```
tests/                    # Cross-cutting and server tests
├── auth/                # OAuth authentication flows
└── server/              # API endpoint tests

src/                     # Co-located with source code
├── utils/*.test.ts      # Utility function tests
└── components/__tests__/ # React component tests
```

### Writing Tests

1. **Follow existing patterns** in similar test files
2. **Use descriptive test names**: 
   ```javascript
   it('should convert @{Person Name} to LinkedIn format correctly', () => {
   ```

3. **Include edge cases** and error scenarios
4. **Mock external dependencies** appropriately
5. **Maintain 70%+ test coverage** (checked automatically)

### Running Tests

```bash
# Run all tests
npm test

# Run specific test files
npm test src/utils/textFormatting.test.ts
npm test tests/auth/

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## 📋 Code Standards

### TypeScript Guidelines

- **Use TypeScript** for all new code
- **Define proper types** instead of using `any`
- **Export interfaces** for reusable types
- **Use strict mode** settings (already configured)

### React Best Practices

- **Functional components** with hooks (no class components)
- **Proper prop types** with TypeScript interfaces
- **Use React.memo()** for performance optimization when needed
- **Handle loading and error states** appropriately

### Code Style

We use automated tools for consistent formatting:

- **ESLint** for code quality
- **Prettier** for code formatting (auto-configured)
- **4-space indentation**
- **Single quotes** for strings
- **Trailing commas** in multiline structures

### File Organization

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication-related components
│   ├── formatting/     # Text formatting components
│   ├── platform/       # Platform-specific components
│   └── ui/             # Generic UI components
├── hooks/              # Custom React hooks
├── services/           # API and external service interactions
├── utils/              # Pure utility functions
├── types/              # TypeScript type definitions
└── constants/          # Application constants
```

## 🎯 Contribution Areas

### High Priority

- 🔗 **New platform integrations** (Instagram, Facebook, etc.)
- 🛡️ **Security improvements** (OAuth security, input validation)
- ⚡ **Performance optimizations** (bundle size, loading speed)
- ♿ **Accessibility improvements** (ARIA labels, keyboard navigation)

### Medium Priority

- 🎨 **UI/UX enhancements** (design improvements, animations)
- 📱 **Mobile responsiveness** improvements
- 🌐 **Internationalization** (i18n) support
- 🔄 **Advanced features** (post scheduling, analytics)

### Documentation

- 📚 **API documentation** improvements
- 🎥 **Video tutorials** or **GIF demos**
- 🌍 **Translation** of documentation
- 💡 **Usage examples** and **best practices**

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Test with latest version** of the application
3. **Check troubleshooting** section in SETUP.md

### Bug Report Template

```markdown
**Bug Description**
A clear description of what the bug is.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g., macOS, Windows, Linux]
- Browser: [e.g., Chrome, Firefox, Safari]
- Node.js version: [e.g., 18.0.0]
- App version: [e.g., 0.2.1]

**Additional Context**
Any other relevant information.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
**Feature Description**
A clear description of the feature you'd like to see.

**Problem Statement**
What problem would this feature solve?

**Proposed Solution**
How do you envision this feature working?

**Alternatives Considered**
Any alternative solutions you've considered.

**Additional Context**
Mockups, examples, or references.
```

## 📤 Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run quality checks locally**:
   ```bash
   npm run lint           # Code quality checks
   npm run format:check   # Formatting verification
   npm run type-check     # TypeScript compilation
   npm test              # All 120 tests
   npm run build         # Production build
   ```

3. **Update documentation** if needed

### Automated Workflows

When you submit a pull request, **GitHub Actions workflows automatically run**:

- ✅ **CI Pipeline**: Multi-node testing, linting, build verification
- 🧪 **Test Suite**: Automated tests on supported Node.js releases
- 📋 **Code Quality**: TypeScript checks, formatting, bundle analysis
- 🛡️ **Security**: Dependency audits and vulnerability scanning

**All checks must pass** before your PR can be merged.

### Pull Request Template

```markdown
**Description**
Brief description of changes.

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

**Testing**
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed

**Screenshots**
If applicable, add screenshots of UI changes.

**Checklist**
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is commented where necessary
- [ ] Documentation updated
```

### Review Process

1. **Automated checks** must pass (tests, build, linting)
2. **Code review** by maintainers
3. **Testing** on multiple platforms if applicable
4. **Approval** and merge by maintainers

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Expected Behavior

- **Be respectful** and inclusive in communications
- **Provide constructive feedback** in code reviews
- **Focus on the technical merit** of contributions
- **Help newcomers** get started with the project
- **Acknowledge different perspectives** and experiences

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Public or private harassment
- Spam or excessive self-promotion

## 📞 Getting Help

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and community chat
- **Code Reviews** - Technical discussions during PR review

### Documentation Resources

- **[SETUP.md](SETUP.md)** - Complete setup and configuration guide
- **[TESTING.md](TESTING.md)** - Comprehensive testing guide
- **[README.md](README.md)** - Project overview and quick start
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

## 🎉 Recognition

Contributors will be:
- **Listed** in our contributors section
- **Mentioned** in release notes for significant contributions
- **Thanked** publicly for their valuable contributions

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](LICENSE) file).

---

Thank you for contributing to the Social Media Kit! Your efforts help make this tool better for everyone. 🚀
