const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function updatePdfFields(updates) {
    const pdfPath = path.join(__dirname, '../../pdf/SEPA_Direct_Debit_mandate.pdf');
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const form = pdfDoc.getForm();

    if (updates.fullName) {
        const fullNameField = form.getTextField('updateFullName');
        fullNameField.setText(updates.fullName);
    }

    if (updates.iban) {
        const ibanField = form.getTextField('updateIBAN');
        ibanField.setText(updates.iban);
    }

    if (updates.bic) {
        const bicField = form.getTextField('updateBIC');
        bicField.setText(updates.bic);
    }

    // Remove the form fields after setting their values so that the PDF doesn't have editable fields.
    form.flatten();

    return await pdfDoc.save();
}

module.exports = { updatePdfFields };
