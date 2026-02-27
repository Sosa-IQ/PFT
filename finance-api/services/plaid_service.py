"""
services/plaid_service.py — Plaid API wrapper.

Centralises all direct Plaid client calls so routers stay thin.
"""

import os
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from dotenv import load_dotenv

load_dotenv()

# Map the PLAID_ENV string to the correct Plaid host constant.
# Note: plaid-python >= 9.x removed Environment.Development.
_ENV_MAP = {
    "sandbox": plaid.Environment.Sandbox,
    "development": plaid.Environment.Sandbox,  # no longer a separate env in SDK v9+
    "production": plaid.Environment.Production,
}


def _build_client() -> plaid_api.PlaidApi:
    client_id = os.getenv("PLAID_CLIENT_ID")
    secret = os.getenv("PLAID_SECRET")
    env_name = os.getenv("PLAID_ENV", "sandbox").lower()

    if not client_id or not secret:
        raise RuntimeError("PLAID_CLIENT_ID and PLAID_SECRET must be set in .env")

    host = _ENV_MAP.get(env_name, plaid.Environment.Sandbox)
    configuration = plaid.Configuration(
        host=host,
        api_key={"clientId": client_id, "secret": secret},
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


# Single Plaid client instance shared across all requests.
_plaid: plaid_api.PlaidApi = _build_client()


def create_link_token(user_id: str) -> str:
    """
    Create a Plaid Link token for the given user.
    The frontend uses this token to open the Plaid Link UI.
    """
    request = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        client_name="Finance Tracker",
        products=[Products("transactions")],
        country_codes=[CountryCode("US")],
        language="en",
    )
    response = _plaid.link_token_create(request)
    return response["link_token"]


def exchange_public_token(public_token: str) -> dict:
    """
    Exchange a short-lived public_token (from Plaid Link) for a permanent access_token.
    Returns {"access_token": str, "item_id": str}.
    """
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = _plaid.item_public_token_exchange(request)
    return {
        "access_token": response["access_token"],
        "item_id": response["item_id"],
    }


def get_accounts(access_token: str) -> list[dict]:
    """
    Fetch all accounts associated with an access token.
    Returns a list of account dicts with Plaid account details.
    """
    request = AccountsGetRequest(access_token=access_token)
    response = _plaid.accounts_get(request)

    accounts = []
    for acct in response["accounts"]:
        accounts.append({
            "plaid_account_id": acct["account_id"],
            "account_name": acct.get("name"),
            "account_type": str(acct.get("type", "")),
            "current_balance": float(acct["balances"]["current"] or 0),
            "available_balance": float(acct["balances"].get("available") or 0),
            "currency": acct["balances"].get("iso_currency_code", "USD"),
        })
    return accounts


def sync_transactions(access_token: str, cursor: str | None = None) -> dict:
    """
    Fetch new/changed/removed transactions since the last sync cursor.

    Pass cursor=None on the first call to get the full transaction history.
    Store the returned next_cursor and pass it on subsequent calls to get
    only the delta (new/modified/removed transactions).

    Returns:
        {
            "added": [...],
            "modified": [...],
            "removed": [...],
            "next_cursor": str,
        }
    """
    added = []
    modified = []
    removed = []
    next_cursor = cursor

    # Plaid paginates large result sets; loop until has_more is False.
    while True:
        kwargs = {"access_token": access_token}
        if next_cursor:
            kwargs["cursor"] = next_cursor

        request = TransactionsSyncRequest(**kwargs)
        response = _plaid.transactions_sync(request)

        added += response["added"]
        modified += response["modified"]
        removed += response["removed"]
        next_cursor = response["next_cursor"]

        if not response["has_more"]:
            break

    return {
        "added": added,
        "modified": modified,
        "removed": removed,
        "next_cursor": next_cursor,
    }
