# Multi-Currency on Invoices

**Date:** 2026-03-27
**Status:** Approved

## Problem

Currency/ExchangeRate models and CRUD UI exist, but invoices are IDR-only. Customer.currency field exists but is hidden. convertToIDR() helper exists but is never called.

## Design

Add currencyCode + exchangeRate + amountInIDR fields to Invoice, Quotation, SalesOrder. GL posting always in IDR (converted). Keep existing reports IDR-denominated.
