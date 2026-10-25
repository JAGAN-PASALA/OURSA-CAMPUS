# Institution domains and tenant isolation

The platform serves many colleges and schools from one deployment. Users first search for and select their institution; an institution-specific domain can also resolve it automatically. Users, students, courses, academic plans, assessments, incidents, audits and encrypted face profiles are filtered by that institution.

## Provision a customer

On a fresh production database, set `SEED_DEMO_DATA=false`, configure the environment secrets, and run `python scripts/create_platform_admin.py` once to create the root platform domain and administrator.

1. Search for the platform organisation, select **Administrator**, and sign in with the root account.
2. Open **Institutions** and create the customer with its exact domain, for example `abc.oursapp.in`.
3. Give the generated institution administrator credentials to the authorised customer contact using a secure channel.
4. In the DNS provider for `oursapp.in`, add a CNAME for `abc` to the application host, or an A/AAAA record to its load balancer.
5. Configure the reverse proxy/load balancer to accept the domain and issue an HTTPS certificate.
6. Add the public frontend origin to `CORS_ORIGINS` if the API is hosted on a different origin.

For custom customer-owned domains, ask the customer to point a CNAME such as `classroom.college.edu` to the application host, then register that exact domain in **Institutions**.

## Security model

- The API resolves the tenant from the institution selected in the public portal or from its registered request domain.
- The signed session includes `institution_id`; a session cannot be reused on a different registered institution domain.
- Only the platform administrator can create institutions or train/publish the shared behaviour model.
- Each student face template is linked to a tenant-owned student and matching only loads embeddings from the current tenant.
- Behaviour pose samples and the behaviour classifier are shared across tenants; raw camera frames are not stored by the sample collector.

## Production proxy example

Forward the original host and HTTPS scheme to FastAPI, restrict direct access to the API port, and terminate TLS at the proxy. The exact configuration depends on Nginx, Caddy, Traefik, Cloudflare, or the cloud load balancer used. Test unknown domains, cross-domain session rejection, and certificate renewal before onboarding a customer.
