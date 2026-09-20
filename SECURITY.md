# Security policy

Velum handles payments and encrypted chat data. If you find a security issue,
please report it privately rather than opening a public issue.

## Reporting

Email security@velum.run with a description of the issue and steps to
reproduce it. Include the affected version or commit if known. You should get
a response within a few days.

Please do not:

- Open a public GitHub issue for a security vulnerability
- Test against the live production instance at velum.run beyond what is
  needed to demonstrate the issue
- Access, modify, or exfiltrate data that is not your own

## Scope

In scope: authentication and account handling, credit and billing logic,
encryption of stored data, payment integrations (Dodo Payments, BTCPay
Server), and anything that could expose one account's data to another.

Out of scope: issues in third-party dependencies without a demonstrated
impact on Velum itself, and denial-of-service via brute-force volume rather
than a logic flaw.

## Supported versions

Only the `main` branch and the version currently deployed at velum.run are
supported. There are no maintained release branches.
