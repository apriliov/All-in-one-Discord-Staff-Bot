// Turns a list of editable fields into slash subcommands, e.g. /paneledit title id:1 value:Support
// Each field becomes its own subcommand. The subcommand name reaches run() as args.field.
function fieldSubcommands(fields, hints, lead = []) {
  return fields.map((field) => {
    const hint = hints[field];
    if (!hint) throw new Error(`Missing slash hint for field "${field}".`);
    const value = { name: 'value', type: 'string', description: hint.value, required: true, maxLength: hint.max || 1500 };
    if (hint.choices) value.choices = hint.choices;
    return { name: field, description: hint.about, options: [...lead, value] };
  });
}

module.exports = { fieldSubcommands };
