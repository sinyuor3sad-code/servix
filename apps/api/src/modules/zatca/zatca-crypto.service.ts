import { Injectable, Logger } from '@nestjs/common';
import { createHash, createSign, generateKeyPairSync } from 'crypto';
import { ZatcaTlvData } from './zatca.types';

/**
 * ZATCA Cryptographic Operations
 * Handles CSR generation, invoice signing, hashing, and QR code TLV encoding.
 */
@Injectable()
export class ZatcaCryptoService {
  private readonly logger = new Logger(ZatcaCryptoService.name);

  /**
   * Generate ECDSA key pair and Certificate Signing Request (CSR)
   */
  generateCSR(params: {
    commonName: string;
    organizationName: string;
    countryCode: string;
    serialNumber: string;
  }): { privateKey: string; csr: string } {
    // Generate ECDSA P-256 key pair
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Build a simplified CSR structure
    // In production, use node-forge or openssl for proper X.509 CSR
    const csrData = [
      `CN=${params.commonName}`,
      `O=${params.organizationName}`,
      `C=${params.countryCode}`,
      `SERIALNUMBER=${params.serialNumber}`,
      `OU=SERVIX EGS Unit`,
    ].join(', ');

    this.logger.log(`CSR generated for: ${params.commonName}`);

    return {
      privateKey,
      csr: Buffer.from(`-----BEGIN CERTIFICATE REQUEST-----\n${Buffer.from(csrData).toString('base64')}\n-----END CERTIFICATE REQUEST-----`).toString(),
    };
  }

  /**
   * Hash invoice XML using SHA-256
   */
  hashInvoice(xml: string): string {
    return createHash('sha256').update(xml, 'utf8').digest('base64');
  }

  /**
   * Sign invoice XML with private key
   */
  signInvoice(xml: string, privateKey: string): string {
    const sign = createSign('SHA256');
    sign.update(xml);
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Generate TLV-encoded QR code data per ZATCA specifications
   * TLV = Tag-Length-Value encoding
   */
  generateTLV(data: ZatcaTlvData): string {
    const tlvParts: Buffer[] = [];

    const addTlv = (tag: number, value: string) => {
      const valueBuffer = Buffer.from(value, 'utf8');
      const tagBuffer = Buffer.from([tag]);
      const lengthBuffer = Buffer.from([valueBuffer.length]);
      tlvParts.push(Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]));
    };

    // ZATCA TLV tags
    addTlv(1, data.sellerName);         // Seller name
    addTlv(2, data.vatNumber);          // VAT registration number
    addTlv(3, data.timestamp);          // Invoice timestamp (ISO 8601)
    addTlv(4, data.totalWithVat);       // Invoice total with VAT
    addTlv(5, data.vatAmount);          // VAT amount
    addTlv(6, data.invoiceHash);        // Invoice hash
    addTlv(7, data.signature);          // Digital signature
    addTlv(8, data.publicKey);          // Seller's public key

    return Buffer.concat(tlvParts).toString('base64');
  }

  /**
   * Embed XML-DSIG signature into invoice XML
   */
  embedSignature(xml: string, signature: string, hash: string): string {
    const signatureBlock = `
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ds:SignedInfo>
      <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
      <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
      <ds:Reference URI="">
        <ds:Transforms>
          <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
            <ds:XPath>not(//ancestor-or-self::ds:Signature)</ds:XPath>
          </ds:Transform>
          <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
        </ds:Transforms>
        <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <ds:DigestValue>${hash}</ds:DigestValue>
      </ds:Reference>
    </ds:SignedInfo>
    <ds:SignatureValue>${signature}</ds:SignatureValue>
  </ds:Signature>`;

    // Insert before closing </Invoice> tag
    return xml.replace('</Invoice>', `${signatureBlock}\n</Invoice>`);
  }
}
